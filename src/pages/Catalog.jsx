import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  listClayBodies,
  listGlazes,
  listClayFavorites,
  listGlazeFavorites,
  toggleClayFavorite,
  toggleGlazeFavorite,
} from '../lib/catalog.js'
import ClayCard from '../components/catalog/ClayCard.jsx'
import GlazeCard from '../components/catalog/GlazeCard.jsx'
import ClayDetail from '../components/catalog/ClayDetail.jsx'
import GlazeDetail from '../components/catalog/GlazeDetail.jsx'
import BottomSheet from '../components/BottomSheet.jsx'

const CLAY_CATEGORIES = ['stoneware', 'porcelain', 'earthenware', 'sculpture']
const CLAY_TEXTURES = ['smooth', 'fine grog', 'medium grog', 'heavy grog']
const GLAZE_FINISHES = ['glossy', 'satin', 'matte', 'textural']

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-colors ${
        active
          ? 'bg-[#78350f] text-white hover:bg-[#5c2709]'
          : 'bg-stone-100 text-[#7c5545] hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  )
}

export default function Catalog({ user }) {
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const tab = tabParam === 'glazes' ? 'glazes' : 'clay'

  const [clayBodies, setClayBodies] = useState([])
  const [glazes, setGlazes] = useState([])
  const [clayFaves, setClayFaves] = useState(new Set())
  const [glazeFaves, setGlazeFaves] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  // clay filters
  const [clayCategory, setClayCategory] = useState(null)
  const [clayTexture, setClayTexture] = useState(null)

  // glaze filters
  const [glazeFinish, setGlazeFinish] = useState(null)
  const [foodSafeOnly, setFoodSafeOnly] = useState(false)

  // detail sheet
  const [selectedClay, setSelectedClay] = useState(null)
  const [selectedGlaze, setSelectedGlaze] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [cb, gz, cf, gf] = await Promise.all([
        listClayBodies(),
        listGlazes(),
        listClayFavorites(user.id),
        listGlazeFavorites(user.id),
      ])
      setClayBodies(cb)
      setGlazes(gz)
      setClayFaves(cf)
      setGlazeFaves(gf)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  function setTab(next) {
    if (next === tab) return
    // Reset tab-specific filters; search + faves toggle persist by design (cross-cutting).
    setClayCategory(null)
    setClayTexture(null)
    setGlazeFinish(null)
    setFoodSafeOnly(false)
    navigate(`/catalog/${next}`)
  }

  function clearFilters() {
    setSearch('')
    setFavoritesOnly(false)
    setClayCategory(null)
    setClayTexture(null)
    setGlazeFinish(null)
    setFoodSafeOnly(false)
  }

  async function handleToggleClay(id, on) {
    setClayFaves(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
    try {
      await toggleClayFavorite(user.id, id, on)
    } catch (err) {
      setClayFaves(prev => {
        const next = new Set(prev)
        if (on) next.delete(id); else next.add(id)
        return next
      })
      setError(err.message)
    }
  }

  async function handleToggleGlaze(id, on) {
    setGlazeFaves(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
    try {
      await toggleGlazeFavorite(user.id, id, on)
    } catch (err) {
      setGlazeFaves(prev => {
        const next = new Set(prev)
        if (on) next.delete(id); else next.add(id)
        return next
      })
      setError(err.message)
    }
  }

  const filteredClay = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clayBodies.filter(c => {
      if (clayCategory && c.category !== clayCategory) return false
      if (clayTexture && c.texture !== clayTexture) return false
      if (favoritesOnly && !clayFaves.has(c.id)) return false
      if (q) {
        const hay = `${c.name} ${c.manufacturer || ''} ${c.notes || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [clayBodies, search, clayCategory, clayTexture, favoritesOnly, clayFaves])

  const filteredGlazes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return glazes.filter(g => {
      if (glazeFinish && g.finish !== glazeFinish) return false
      if (foodSafeOnly && !g.food_safe) return false
      if (favoritesOnly && !glazeFaves.has(g.id)) return false
      if (q) {
        const hay = `${g.name} ${g.family || ''} ${g.notes || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [glazes, search, glazeFinish, foodSafeOnly, favoritesOnly, glazeFaves])

  const isClay = tab === 'clay'
  const visible = isClay ? filteredClay : filteredGlazes
  const sourceCount = isClay ? clayBodies.length : glazes.length
  const filtersActive = search || favoritesOnly || clayCategory || clayTexture || glazeFinish || foodSafeOnly

  return (
    <div className="flex flex-col min-h-screen bg-[#fafaf9]">
      <header className="px-5 pt-safe bg-[#fafaf9] sticky top-0 z-10">
        <div className="flex items-center justify-between pt-3 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/board')}
              className="text-muted hover:text-stone-600 cursor-pointer active:text-stone-600"
              aria-label="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <h1 className="font-display italic text-3xl text-[#1c1917]">Catalog.</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-stone-200">
          {[['clay', 'Clay'], ['glazes', 'Glazes']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2 -mb-px text-sm font-semibold uppercase tracking-widest cursor-pointer ${
                tab === key
                  ? 'text-[#78350f] border-b-2 border-[#78350f]'
                  : 'text-muted hover:text-[#5c2709]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="pt-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isClay ? 'Search clay bodies…' : 'Search glazes…'}
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-[#78350f]/60 placeholder:text-muted"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5 scrollbar-none">
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}>
            ♥ Favorites
          </Chip>
          {isClay ? (
            <>
              {CLAY_CATEGORIES.map(cat => (
                <Chip
                  key={cat}
                  active={clayCategory === cat}
                  onClick={() => setClayCategory(prev => prev === cat ? null : cat)}
                >
                  {cat}
                </Chip>
              ))}
              {CLAY_TEXTURES.map(t => (
                <Chip
                  key={t}
                  active={clayTexture === t}
                  onClick={() => setClayTexture(prev => prev === t ? null : t)}
                >
                  {t}
                </Chip>
              ))}
            </>
          ) : (
            <>
              {GLAZE_FINISHES.map(f => (
                <Chip
                  key={f}
                  active={glazeFinish === f}
                  onClick={() => setGlazeFinish(prev => prev === f ? null : f)}
                >
                  {f}
                </Chip>
              ))}
              <Chip active={foodSafeOnly} onClick={() => setFoodSafeOnly(v => !v)}>
                food safe
              </Chip>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-24">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#78350f] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-2 py-8">
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={fetchAll} className="text-xs uppercase tracking-widest text-[#78350f] font-semibold cursor-pointer hover:text-[#5c2709]">
              Retry
            </button>
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            {favoritesOnly && sourceCount > 0 ? (
              <p className="text-muted text-sm">
                Tap the heart on any {isClay ? 'clay body' : 'glaze'} to save it here.
              </p>
            ) : sourceCount === 0 ? (
              <p className="text-muted text-sm">
                Catalog is empty. Run <code className="text-xs">npm run seed:catalog</code>.
              </p>
            ) : (
              <>
                <p className="text-muted text-sm">No {isClay ? 'clay bodies' : 'glazes'} match your filters.</p>
                {filtersActive && (
                  <button
                    onClick={clearFilters}
                    className="text-xs uppercase tracking-widest text-[#78350f] font-semibold cursor-pointer hover:text-[#5c2709]"
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 pt-2">
            {isClay
              ? filteredClay.map(c => (
                  <ClayCard
                    key={c.id}
                    clay={c}
                    favorite={clayFaves.has(c.id)}
                    onToggleFavorite={handleToggleClay}
                    onOpen={setSelectedClay}
                  />
                ))
              : filteredGlazes.map(g => (
                  <GlazeCard
                    key={g.id}
                    glaze={g}
                    favorite={glazeFaves.has(g.id)}
                    onToggleFavorite={handleToggleGlaze}
                    onOpen={setSelectedGlaze}
                  />
                ))
            }
          </div>
        )}
      </main>

      <BottomSheet
        open={!!selectedClay}
        onClose={() => setSelectedClay(null)}
        title={selectedClay?.name}
      >
        <ClayDetail
          clay={selectedClay}
          favorite={selectedClay ? clayFaves.has(selectedClay.id) : false}
          onToggleFavorite={handleToggleClay}
        />
      </BottomSheet>

      <BottomSheet
        open={!!selectedGlaze}
        onClose={() => setSelectedGlaze(null)}
        title={selectedGlaze?.name}
      >
        <GlazeDetail
          glaze={selectedGlaze}
          favorite={selectedGlaze ? glazeFaves.has(selectedGlaze.id) : false}
          onToggleFavorite={handleToggleGlaze}
        />
      </BottomSheet>
    </div>
  )
}
