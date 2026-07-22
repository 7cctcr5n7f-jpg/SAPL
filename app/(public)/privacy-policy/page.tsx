import { LegalBlock, LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata = { title: "Privacy Policy | SAPL" }

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      intro="This privacy policy is a modern placeholder describing the types of personal information SAPL may collect and how that information is expected to be used."
    >
      <LegalBlock title="Information We Collect">
        <p>SAPL may collect and process personal information such as your name, email address, phone number, team details, and related registration information.</p>
        <p>
          Payment information may also be processed securely through an appointed payment provider once payment
          functionality is implemented.
        </p>
      </LegalBlock>

      <LegalBlock title="How Information May Be Used">
        <p>
          Personal information may be used to administer registrations, manage teams and fixtures, communicate with
          participants, support league operations, and maintain platform security.
        </p>
      </LegalBlock>

      <LegalBlock title="Data Protection">
        <p>
          SAPL intends to apply reasonable administrative and technical safeguards appropriate to the platform and its
          operational needs.
        </p>
      </LegalBlock>

      <LegalBlock title="POPIA Placeholder">
        <p>
          SAPL intends to comply with applicable South African privacy requirements, including POPIA, once this policy
          has completed formal legal review.
        </p>
        <p>This privacy policy is placeholder content pending legal review before production launch.</p>
      </LegalBlock>
    </LegalPageShell>
  )
}

