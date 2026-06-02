import { getBarSpecials, getPopupSpecials } from '@/lib/content-queries'
import { SpecialBar } from './special-bar'
import { SpecialPopup } from './special-popup'
import { toClientSpecial } from './types'

// Site-wide specials: a single sticky bar and a single popup (first active of each).
export async function SpecialsGlobal() {
  const [barSpecials, popupSpecials] = await Promise.all([getBarSpecials(), getPopupSpecials()])
  const bar = barSpecials[0] ? toClientSpecial(barSpecials[0]) : null
  const popup = popupSpecials[0] ? toClientSpecial(popupSpecials[0]) : null

  return (
    <>
      <SpecialBar special={bar} />
      <SpecialPopup special={popup} />
    </>
  )
}
