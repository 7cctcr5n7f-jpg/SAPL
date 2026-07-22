import { LegalBlock, LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata = { title: "Cancellation Policy | SAPL" }

export default function CancellationPolicyPage() {
  return (
    <LegalPageShell
      title="Cancellation Policy"
      intro="This placeholder cancellation policy outlines how SAPL expects registration cancellations to be handled before the production legal wording is finalised."
    >
      <LegalBlock title="Registration Cancellations">
        <p>League registrations may be cancelled before registration closes.</p>
        <p>Administrative fees may apply.</p>
        <p>Once fixtures have been generated, registrations are generally non-refundable.</p>
        <p>SAPL reserves the right to review exceptional circumstances.</p>
        <p>This cancellation policy is placeholder content pending legal review before production launch.</p>
      </LegalBlock>
    </LegalPageShell>
  )
}

