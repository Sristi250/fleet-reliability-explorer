import type { Model } from '../data/types'
import type { Slice } from '../data/views'
import { Segmented, Select } from './controls'
import { MODEL_LABEL } from './models'

export interface DepotInfo {
  name: string
  models: Model[]
}

const MODEL_OPTIONS: { value: Slice['model']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'DD', label: 'Double-deck' },
  { value: 'SD', label: 'Single-deck' },
]

/** Model and depot filters, shared by every view so the slice carries across tabs. */
export function SliceFilters({ slice, setSlice, depots }: {
  slice: Slice; setSlice: (s: Slice) => void; depots: DepotInfo[]
}) {
  return (
    <>
      <Segmented label="Model" value={slice.model} options={MODEL_OPTIONS} onChange={(model) => setSlice({ ...slice, model })} />
      <Select
        label="Depot"
        value={slice.depot}
        onChange={(depot) => setSlice({ ...slice, depot })}
        options={[
          { value: 'all', label: 'All depots' },
          ...depots.map((d) => ({
            value: d.name,
            label: slice.model !== 'all' && !d.models.includes(slice.model)
              ? `${d.name} (no ${MODEL_LABEL[slice.model].toLowerCase()} buses)`
              : d.name,
          })),
        ]}
      />
    </>
  )
}

/** Shown when the filters leave no buses, with a way out. */
export function EmptySlice({ slice, setSlice }: { slice: Slice; setSlice: (s: Slice) => void }) {
  const what = slice.model === 'all' ? 'buses' : `${MODEL_LABEL[slice.model].toLowerCase()} buses`
  const where = slice.depot === 'all' ? 'in the fleet' : `at ${slice.depot}`
  return (
    <div className="state" role="status">
      <strong>No {what} {where}.</strong>
      <span>Change the model or depot filter to see results.</span>
      <div className="state-actions">
        {slice.model !== 'all' && (
          <button type="button" className="btn-ghost" onClick={() => setSlice({ ...slice, model: 'all' })}>Show all models</button>
        )}
        {slice.depot !== 'all' && (
          <button type="button" className="btn-ghost" onClick={() => setSlice({ ...slice, depot: 'all' })}>Show all depots</button>
        )}
      </div>
    </div>
  )
}
