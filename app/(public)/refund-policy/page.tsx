import { LegalBlock, LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata = { title: "Refund Policy | SAPL" }

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      title="Refund Policy"
      intro="This placeholder refund policy describes SAPL's intended approach to refunds until final legal wording is approved."
    >
      <LegalBlock title="Refunds">
        <p>Refunds are considered before league commencement.</p>
        <p>No refunds after the season has started except where required by law.</p>
        <p>
          If SAPL cancels a league before commencement, participants may receive a full or partial refund.
        </p>
        <p>Refund requests should be submitted via support.</p>
        <p>This refund policy is placeholder content pending legal review before production launch.</p>
      </LegalBlock>
    </LegalPageShell>
  )
}

