// Single source of truth for the TENROUNDS membership legal content.
// Reused by the signup form (on-screen display + downloadable agreement) and
// by the server-side PDF generator so the member and the stored record always
// match exactly.

export const DEBIT_ORDER_SHORTNAME = '10ROUNDS'

// Netcash debit-order authority & mandate wording shown in Section 3.
export const MANDATE_TEXT = `Abbreviated short name to be used: ${DEBIT_ORDER_SHORTNAME}

I/We hereby authorise Netcash (Pty) Ltd to issue and deliver payment instructions to your banker for collection against my/our abovementioned account at my/our abovementioned bank on condition that the sum of such payment instructions will not differ from my/our obligations as agreed to in the Contract Reference Number.

The individual payment instructions so authorised must be issued and delivered on the date when the obligation in terms of the Agreement is due and the amount of each individual payment instruction may not differ as agreed to in terms of the Agreement. The payment instructions so authorised to be issued must carry the Contract Reference Number, included in the said payment instructions, and must be provided to identify the specific contract. The said Contract Reference Number should be added to this form before the issuing of any payment instruction and communicated directly after having been completed.

I/we agree that the first payment instruction will be issued and delivered within 3 days of sign up and thereafter regularly each month on the day selected below. If however, the date of the payment instruction falls on a non-processing day (weekend or public holiday) I agree that the payment instruction may be debited against my account on the following business day.

Subsequent payment instructions will continue to be delivered in terms of this authority until the obligations in terms of the Agreement have been paid or until this authority is cancelled by me/us by giving you notice in writing of not less than the interval (as indicated in the previous clause) and sent by prepaid registered post or delivered to your address indicated above.

B. MANDATE
I/we acknowledge that all payment instructions issued by you will be treated by my/our abovementioned bank as if the instructions had been issued by me/us personally.

C. CANCELLATION
I/we agree that although this authority and mandate may be cancelled by me/us, such cancellation will not cancel the Agreement. I/we shall not be entitled to any refund of amounts which you have withdrawn while this authority was in force, if such amounts were legally owing to you.

D. ASSIGNMENT
I/we acknowledge that this authority may be ceded or assigned to a third party if the Agreement is also ceded or assigned to that third party, but in the absence of such assignment of the Agreement, this authority and mandate cannot be assigned to any third party.`

// The full membership agreement, broken into the sections required by the
// signup spec. Rendered on screen and embedded in the downloadable PDF.
export const AGREEMENT_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By signing this membership agreement, the member confirms that they have read, understood and agree to be bound by the terms and conditions set out herein. This agreement constitutes the entire agreement between the member and TENROUNDS and supersedes any prior verbal or written arrangements.',
  },
  {
    heading: '2. Fees and Payment',
    body: 'The member agrees to pay the monthly membership fee for the full duration of the selected contract term. Debit order payments are collected via Netcash on the selected debit order date each month. Cash memberships must be settled in full, in advance, for the entire contract duration — monthly cash instalments are not permitted. Failed or returned debit orders may attract a reasonable administration fee and the member remains liable for all outstanding amounts.',
  },
  {
    heading: '3. Cancellation and Early Termination',
    body: 'The member must provide no less than 30 (thirty) days written notice to cancel their membership. Should the member terminate the agreement before the end of the agreed contract term, an early termination fee equal to two-thirds (2/3) of the remaining contract value becomes immediately due and payable. Memberships are not transferable without the prior written consent of TENROUNDS.',
  },
  {
    heading: '4. Health and Safety',
    body: 'The member warrants that they are medically fit to participate in high-intensity exercise and have disclosed any relevant medical conditions. The member agrees to follow all instructions given by TENROUNDS coaches and staff, to use equipment correctly, and to immediately report any injury, discomfort or equipment fault. Participation is undertaken at the member’s own risk.',
  },
  {
    heading: '5. Liability and Indemnity',
    body: 'To the fullest extent permitted by law, the member indemnifies and holds harmless TENROUNDS, its owners, employees and coaches against any claim, loss, injury, death or damage to person or property arising out of or in connection with the member’s use of the facilities, save where caused by the gross negligence of TENROUNDS. TENROUNDS is not responsible for personal property that is lost, stolen or damaged on the premises.',
  },
  {
    heading: '6. Gym Rules',
    body: 'The member agrees to abide by all gym rules as displayed at the studio and as amended from time to time, including rules regarding conduct, hygiene, equipment use, booking and access. TENROUNDS reserves the right to suspend or terminate the membership of any member who breaches these rules or behaves in a manner that endangers or disturbs other members or staff.',
  },
  {
    heading: '7. Privacy Notice',
    body: 'TENROUNDS collects and processes the member’s personal information (including contact, identity, payment and health-related information) for the purposes of administering the membership, processing payments, communicating with the member and complying with legal obligations. Information is stored securely and is only shared with third parties (such as payment processors) where necessary to provide the service.',
  },
  {
    heading: '8. POPIA Compliance',
    body: 'TENROUNDS processes personal information in accordance with the Protection of Personal Information Act, 4 of 2013 (POPIA). The member has the right to access, correct or request deletion of their personal information, and to object to its processing, subject to TENROUNDS’ legal and contractual obligations. Consent to processing may be withdrawn in writing, which may affect the continuation of the membership.',
  },
  {
    heading: '9. Force Majeure',
    body: 'TENROUNDS shall not be liable for any failure or delay in performing its obligations where such failure or delay results from events beyond its reasonable control, including but not limited to acts of God, pandemics, government regulations, load-shedding, fire, flood or civil unrest. Membership fees remain payable during temporary closures unless otherwise communicated by TENROUNDS.',
  },
  {
    heading: '10. Modifications',
    body: 'TENROUNDS may amend these terms, the gym rules, operating hours and class offerings from time to time. Material changes will be communicated to members via email or notice at the studio. Continued use of the facilities after such changes constitutes acceptance of the amended terms.',
  },
  {
    heading: '11. Governing Law',
    body: 'This agreement is governed by and construed in accordance with the laws of the Republic of South Africa. The parties consent to the jurisdiction of the Magistrate’s Court having jurisdiction, notwithstanding that the claim or amount in dispute may exceed the monetary jurisdiction of that court.',
  },
]

// The four mandatory consent checkboxes shown in Section 4.
export const REQUIRED_AGREEMENTS = [
  {
    id: 'agreeTerms',
    title: 'Agreement to Terms',
    body: 'I confirm that I have read and understood the TENROUNDS Membership Terms and Conditions, including the full Privacy Notice and POPIA compliance.',
  },
  {
    id: 'agreeCancellation',
    title: 'Cancellation and Early Termination',
    body: 'I acknowledge and agree that I must provide 30 days’ notice for cancellation and understand that early termination may incur a fee of 2/3 of the remaining contract value.',
  },
  {
    id: 'agreeHealth',
    title: 'Health & Safety and Liability',
    body: 'I accept that participation in TENROUNDS programs is at my own risk and I agree to abide by all gym rules and staff instructions.',
  },
  {
    id: 'agreePrivacy',
    title: 'Privacy and Data Consent',
    body: 'I consent to TENROUNDS processing my personal information as described in the Privacy Notice.',
  },
] as const

export const LEGAL_NOTICE =
  'By ticking the boxes on this form, I acknowledge that I have read and understood the full TENROUNDS Membership Terms and Conditions, including the Privacy Notice, Fees, Cancellation, Early Termination, Health & Safety, Liability, Gym Rules, and all other sections contained in the official Membership Agreement.'

export const MANDATE_CONSENT =
  'I agree to the Debit Order Authority and Mandate.'
