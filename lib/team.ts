export type Coach = {
  name: string
  role: string
  image: string
  bio: string
  specialties: string[]
}

export const coaches: Coach[] = [
  {
    name: 'Tariq "Taj" Hoosan',
    role: 'Senior Coach & Member Experience Lead',
    image: '/team-taj.webp',
    bio: 'Taj is known for his ability to keep members consistent and focused. With a strong background in personal training and group fitness environments, he combines technical knowledge with an encouraging coaching style that helps members push through challenging rounds while maintaining proper form.',
    specialties: [
      'Member support & motivation',
      'Training consistency',
      'Technique correction',
    ],
  },
  {
    name: 'Marc "Paul" Kouya',
    role: 'Head Boxing & Performance Coach',
    image: '/team-paul.webp',
    bio: 'Originally from Ivory Coast, Paul is the boxing specialist at TENROUNDS and the most experienced coach on the team. His sessions emphasise clean technique, rhythm and powerful striking mechanics. Known for his disciplined coaching style, he delivers highly structured rounds and elite-level mitt work that challenge both beginners and experienced members.',
    specialties: [
      'Boxing technique & pad work',
      'High-intensity conditioning',
      'Fight-style movement training',
    ],
  },
  {
    name: 'Stephan de Jager',
    role: 'Strength & Muscle Development Coach',
    image: '/team-stephan.webp',
    bio: 'Stephan specialises in strength development and safe progression. With experience in resistance training and functional conditioning, he helps members build strength and confidence through structured, controlled movement and attention to technique.',
    specialties: [
      'Strength development',
      'Progressive overload training',
      'Injury-aware programming',
    ],
  },
  {
    name: 'Simphiwe "Sims" Ohaba',
    role: 'Performance & Conditioning Coach',
    image: '/team-sims.webp',
    bio: 'Sims brings energy and athletic performance focus to the floor. With experience in conditioning training and movement development, he helps members improve endurance, coordination and overall fitness through dynamic, high-intensity rounds.',
    specialties: [
      'Athletic conditioning',
      'Coordination & agility',
      'Full-body performance training',
    ],
  },
  {
    name: 'Monique Barnard',
    role: 'Mobility & Performance Coach',
    image: '/team-monique.webp',
    bio: 'Monique focuses on movement quality, flexibility and injury-resilient training. Her background in acrobatics and movement training helps members improve mobility, control and balance while supporting long-term strength and conditioning progress.',
    specialties: [
      'Mobility & flexibility',
      'Movement control',
      'Injury-aware training',
    ],
  },
]
