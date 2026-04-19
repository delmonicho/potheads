const KNOWN_FORMS = ['bowl', 'mug', 'cup', 'vase', 'plate', 'pitcher', 'teapot', 'planter']

export default function PotteryPlaceholder({ formTag, className = '' }) {
  const key = formTag?.toLowerCase()
  const src = KNOWN_FORMS.includes(key)
    ? `/placeholders/${key}.svg`
    : `/placeholders/vase.svg`

  return (
    <div className={`w-full h-full rounded-xl overflow-hidden ${className}`}>
      <img src={src} alt="" className="w-full h-full object-cover" />
    </div>
  )
}
