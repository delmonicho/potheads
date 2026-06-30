// Museum-style caption for a portfolio piece. Reads entirely from the
// denormalized portfolio_item fields — no piece/tag data needed.

const STATUS_LABELS = { available: 'Available', sold: 'Sold', nfs: 'Not for sale' }

function MetaRow({ label, value }) {
  if (!value) return null
  return (
    <p className="text-sm text-muted leading-relaxed">
      <span className="uppercase tracking-widest text-[10px] text-muted/80 mr-2">{label}</span>
      {value}
    </p>
  )
}

export default function MuseumLabel({ item }) {
  const glazeNames = Array.isArray(item.glazes)
    ? item.glazes.map((g) => g?.name).filter(Boolean).join(', ')
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display italic text-2xl text-ink leading-tight">
          {item.title || 'Untitled'}
        </h2>
        {item.year && <span className="text-sm text-muted tabular-nums shrink-0">{item.year}</span>}
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <MetaRow label="Form" value={item.form} />
        <MetaRow label="Clay" value={item.clay_body} />
        <MetaRow label="Glaze" value={glazeNames} />
        <MetaRow label="Firing" value={item.firing} />
        <MetaRow label="Size" value={item.dimensions} />
      </div>

      {item.status && (
        <span
          className={`mt-2 inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-widest font-semibold ${
            item.status === 'available'
              ? 'bg-stage-complete/15 text-stage-complete'
              : 'bg-surface-warm text-muted'
          }`}
        >
          {STATUS_LABELS[item.status] || item.status}
        </span>
      )}
    </div>
  )
}
