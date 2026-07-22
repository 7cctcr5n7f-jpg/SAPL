import { LegalBlock, LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata = { title: "Terms & Conditions | SAPL" }

export default function TermsAndConditionsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      intro="These Terms & Conditions govern participation in the South African Padel League platform, registration processes, and league operations."
    >
      <LegalBlock title="League Registration">
        <p>
          League registrations are submitted through the SAPL platform and are subject to availability, administrative
          approval, and the published registration timelines for each season.
        </p>
        <p>These Terms &amp; Conditions are placeholders and will be updated before production launch.</p>
      </LegalBlock>

      <LegalBlock title="Eligibility">
        <p>
          Participants must provide accurate registration information and meet the applicable league, division, and
          category requirements communicated by SAPL.
        </p>
      </LegalBlock>

      <LegalBlock title="Team Registration">
        <p>
          Team captains and organisers are responsible for ensuring that team details, venue selections, and roster
          information remain complete and accurate throughout the registration process.
        </p>
      </LegalBlock>

      <LegalBlock title="Player Responsibilities">
        <p>
          Players are responsible for keeping their account details current, complying with league rules, responding to
          invitations appropriately, and participating in good faith.
        </p>
      </LegalBlock>

      <LegalBlock title="Payment Terms">
        <p>
          Registration fee structures, due dates, and any administrative charges will be communicated by SAPL before
          payment collection is activated. Current payment-related wording is placeholder-only and does not represent a
          live payment service.
        </p>
      </LegalBlock>

      <LegalBlock title="League Rules">
        <p>
          All registered teams and players are expected to follow SAPL&apos;s league rules, fixture requirements,
          conduct standards, and administrative decisions issued for each season.
        </p>
      </LegalBlock>

      <LegalBlock title="Liability">
        <p>
          Participation in SAPL events and use of the platform is at the participant&apos;s own risk, subject to the
          final liability terms that will be reviewed and published before production launch.
        </p>
      </LegalBlock>

      <LegalBlock title="Media Consent">
        <p>
          SAPL may capture and use event-related imagery, video, and promotional material for league communications,
          subject to the final consent language that will be confirmed during legal review.
        </p>
      </LegalBlock>

      <LegalBlock title="Amendments">
        <p>
          SAPL reserves the right to update these terms, operational policies, and registration requirements from time
          to time. Material updates will be published on the platform.
        </p>
      </LegalBlock>

      <LegalBlock title="Contact Information">
        <p>
          For contractual, registration, or policy enquiries, please contact SAPL support through the official contact
          channels published on this site.
        </p>
      </LegalBlock>
    </LegalPageShell>
  )
}

