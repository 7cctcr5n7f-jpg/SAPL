export type GalleryCategory =
  | 'Photoshoot'
  | 'Members Training'
  | 'Inside the Club'
  | 'Technology'
  | 'Equipment'
  | 'Products'
  | 'Exterior'

export type GalleryImage = {
  src: string
  alt: string
  category: GalleryCategory
}

const dir = '/gallery'

export const galleryCategories: GalleryCategory[] = [
  'Photoshoot',
  'Members Training',
  'Inside the Club',
  'Technology',
  'Equipment',
  'Products',
  'Exterior',
]

export const galleryImages: GalleryImage[] = [
  // Photoshoot — people & training
  {
    src: `${dir}/tenrounds-photoshoot-member-boxing-gloves-smile.jpg`,
    alt: 'Smiling TENROUNDS member wearing white boxing gloves beside a heavy bag in Garsfontein',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-boxing-guard-stance-woman.jpg`,
    alt: 'Female member holding a boxing guard stance with white gloves under blue gym lighting',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-founders-coaches-portrait.jpg`,
    alt: 'TENROUNDS founders and head coaches at the Garsfontein boxing fitness gym',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-suspension-trx-training.jpg`,
    alt: 'Member performing suspension TRX rows during a TENROUNDS HIIT workout',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-male-boxer-heavy-bag.jpg`,
    alt: 'Male member training at a boxing heavy bag at TENROUNDS Pretoria East',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-female-boxer-profile.jpg`,
    alt: 'Focused female boxer in profile during a TENROUNDS heart-rate-guided session',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-boxing-training-spotlight.jpg`,
    alt: 'Member boxing in a dramatic spotlight during a TENROUNDS class in Garsfontein',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-heavy-bag-boxing-workout.jpg`,
    alt: 'Member throwing punches at a heavy bag during a TENROUNDS boxing workout',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-coach-led-boxing-session.jpg`,
    alt: 'Coach guiding a member through a boxing combination at TENROUNDS Pretoria East',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-female-members-boxing-duo.jpg`,
    alt: 'Two female members with white boxing gloves at TENROUNDS Garsfontein',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-tenrounds-apparel-male.jpg`,
    alt: 'Member wearing TENROUNDS apparel under blue gym lighting',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-photoshoot-female-boxer-portrait.jpg`,
    alt: 'Portrait of a female member with boxing gloves at TENROUNDS',
    category: 'Photoshoot',
  },
  {
    src: `${dir}/tenrounds-member-boxing-workout-action-garsfontein.jpg`,
    alt: 'Member mid-air during an intense boxing workout at TENROUNDS Garsfontein',
    category: 'Photoshoot',
  },

  // Members Training — real sessions
  {
    src: `${dir}/tenrounds-members-boxing-coach-mitts-training.jpg`,
    alt: 'TENROUNDS members boxing with a coach on focus mitts during a 30-minute HIIT session in Garsfontein',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-mitt-work-coach-garsfontein.jpg`,
    alt: 'Member throwing punches into a coach&apos;s focus mitts at TENROUNDS Pretoria East',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-members-heavy-bag-group-training.jpg`,
    alt: 'Members training together at the boxing heavy bags during a TENROUNDS group workout',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-aqua-bag-boxing-training.jpg`,
    alt: 'Member boxing an aqua training bag at TENROUNDS Garsfontein',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-suspension-training-heart-rate.jpg`,
    alt: 'Member doing suspension strength training while wearing a heart-rate monitor at TENROUNDS',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-coach-aqua-bag-member-boxing.jpg`,
    alt: 'Coach holding an aqua bag while a member practises boxing technique at TENROUNDS Pretoria East',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-focus-mitt-work-group-session.jpg`,
    alt: 'Member throwing a fast combination into a coach&apos;s focus mitts during a TENROUNDS group session in Garsfontein',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-coach-held-aqua-bag-member-straight-punch.jpg`,
    alt: 'Member landing a straight punch on a coach-held aqua bag at TENROUNDS Pretoria East',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-aqua-bag-guard-stance-brick-wall.jpg`,
    alt: 'Member in a boxing guard working an aqua bag against the brick wall at TENROUNDS Garsfontein',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-member-resistance-band-strength-heart-rate.jpg`,
    alt: 'Member doing overhead resistance-band strength work with a heart-rate monitor and round timer at TENROUNDS',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-members-dumbbell-training-live-leaderboard.jpg`,
    alt: 'Members doing dumbbell shoulder work in front of the live heart-rate leaderboard at TENROUNDS Garsfontein',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-coach-pad-work-member-station-corridor.jpg`,
    alt: 'Coach holding pads for a member in the blue-lit station corridor during a TENROUNDS class',
    category: 'Members Training',
  },
  {
    src: `${dir}/tenrounds-members-group-training-stations-floor.jpg`,
    alt: 'Members training together across numbered boxing and conditioning stations on the TENROUNDS floor',
    category: 'Members Training',
  },

  // Inside the Club — facility
  {
    src: `${dir}/tenrounds-gym-interior-dumbbell-zone-garsfontein.jpg`,
    alt: 'Dumbbell training zone with heart-rate effort-zone graphics inside TENROUNDS Garsfontein',
    category: 'Inside the Club',
  },
  {
    src: `${dir}/tenrounds-hiit-gym-floor-heart-rate-zones.jpg`,
    alt: 'TENROUNDS HIIT gym floor with the heart-rate training zone feature wall',
    category: 'Inside the Club',
  },
  {
    src: `${dir}/tenrounds-boxing-bag-station-interior.jpg`,
    alt: 'Boxing bag station with round timer inside TENROUNDS Pretoria East',
    category: 'Inside the Club',
  },
  {
    src: `${dir}/tenrounds-boxing-station-aqua-bags-pretoria-east.jpg`,
    alt: 'Aqua bag boxing stations along the brick wall at TENROUNDS Pretoria East',
    category: 'Inside the Club',
  },
  {
    src: `${dir}/tenrounds-heavy-bags-brick-wall.jpg`,
    alt: 'Heavy boxing bags mounted on the brick wall at TENROUNDS Garsfontein',
    category: 'Inside the Club',
  },
  {
    src: `${dir}/tenrounds-boxing-stations-corridor.jpg`,
    alt: 'Corridor of numbered boxing stations at TENROUNDS Garsfontein',
    category: 'Inside the Club',
  },

  // Equipment
  {
    src: `${dir}/tenrounds-slam-balls-equipment.jpg`,
    alt: 'TENROUNDS slam balls used for functional HIIT training',
    category: 'Equipment',
  },
  {
    src: `${dir}/tenrounds-damascus-heavy-bag.jpg`,
    alt: 'Damascus boxing heavy bag at TENROUNDS Garsfontein',
    category: 'Equipment',
  },

  // Technology — heart-rate tracking & on-screen system
  {
    src: `${dir}/tenrounds-on-screen-leaderboard-heart-rate-tracking.jpg`,
    alt: 'TENROUNDS On Screen leaderboard showing members&apos; heart-rate effort and target zone results',
    category: 'Technology',
  },
  {
    src: `${dir}/tenrounds-heart-rate-screens-dumbbell-training.jpg`,
    alt: 'Members training in front of live heart-rate percentage screens at TENROUNDS Garsfontein',
    category: 'Technology',
  },
  {
    src: `${dir}/tenrounds-boxing-bag-power-tracking-screen.jpg`,
    alt: 'Smart boxing bag tablet displaying punch power and strike tracking at TENROUNDS',
    category: 'Technology',
  },
  {
    src: `${dir}/tenrounds-heart-rate-effort-zone-wall.jpg`,
    alt: 'Heart-rate effort-zone wall showing max effort, anaerobic, aerobic and weight-control zones at TENROUNDS',
    category: 'Technology',
  },

  // Products — 13 supplements & TENROUNDS apparel
  {
    src: `${dir}/tenrounds-13-whey-protein-vanilla-hydrate-electrolytes.jpg`,
    alt: '13 Vanilla 100% Whey Protein tub with 13 Hydrate performance electrolytes available at TENROUNDS',
    category: 'Products',
  },
  {
    src: `${dir}/tenrounds-13-hydrate-performance-electrolytes.jpg`,
    alt: '13 Hydrate performance electrolytes packaging available at TENROUNDS Garsfontein',
    category: 'Products',
  },
  {
    src: `${dir}/tenrounds-13-clear-whey-protein-apple-rooibos.jpg`,
    alt: '13 Apple Rooibos Clear Whey Protein tub available at TENROUNDS Pretoria East',
    category: 'Products',
  },
  {
    src: `${dir}/tenrounds-13-whey-protein-vanilla-tub.jpg`,
    alt: '13 Vanilla 100% Whey Protein supplement tub at TENROUNDS',
    category: 'Products',
  },
  {
    src: `${dir}/tenrounds-branded-apparel-tshirt.jpg`,
    alt: 'TENROUNDS branded training t-shirt apparel',
    category: 'Products',
  },

  // Exterior
  {
    src: `${dir}/tenrounds-gym-exterior-garsfontein-pretoria-east.jpg`,
    alt: 'TENROUNDS gym exterior in Garsfontein, Pretoria East lit up at night',
    category: 'Exterior',
  },
]
