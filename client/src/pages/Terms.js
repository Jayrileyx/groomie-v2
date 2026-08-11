import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-purple-600 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: August 2026</p>

      <div className="prose prose-gray max-w-none flex flex-col gap-6 text-gray-700 text-sm leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. About Groomie</h2>
          <p>Groomie is an online marketplace that connects pet owners ("Customers") with independent pet groomers ("Groomers"). Groomie provides the platform and payment infrastructure but is not a party to the grooming service agreement between Customers and Groomers. All grooming services are performed by independent Groomers, not Groomie employees.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Eligibility</h2>
          <p>You must be at least 18 years old to create an account or use the Groomie platform. By registering, you confirm that all information you provide is accurate and complete.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at support@groomie.com if you suspect unauthorized use of your account. Groomie reserves the right to suspend or terminate accounts that violate these Terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Bookings and Payments</h2>
          <p>When a Customer requests a booking, a valid payment method must be on file. Payment is collected only after the grooming service is marked complete by the Groomer. Groomie charges a platform fee on each completed transaction. All charges are processed securely through Stripe. Groomers receive payouts via Stripe Connect after applicable fees and processing times.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Cancellations and Refunds</h2>
          <p>Customers may cancel bookings before the Groomer's stated cancellation window at no charge. Late cancellations (within the cancellation window) may result in a cancellation flag on the Customer's account. Repeat late cancellations may result in account restrictions. Groomers who cancel appointments may be subject to account review. Refunds for completed services are handled at Groomie's discretion on a case-by-case basis.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Groomer Responsibilities</h2>
          <p>Groomers are independent contractors and are solely responsible for the quality and safety of their services, holding any required licenses or certifications, maintaining appropriate insurance, and complying with all applicable laws. Groomers must complete Groomie's verification process before accepting bookings.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Liability Waiver</h2>
          <p>Grooming services involve inherent risks. Groomie is not liable for injury, illness, or death of any pet during or after a grooming service, property damage arising from a grooming appointment, or the acts or omissions of any Groomer. Customers booking services acknowledge this risk and release Groomie from any related claims. Individual Groomers may require Customers to sign an additional liability waiver before service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Prohibited Conduct</h2>
          <p>You agree not to: misrepresent yourself or your pet's condition, engage in harassment or abusive behavior toward other users, attempt to circumvent the platform by conducting transactions off-platform, submit false or misleading reviews, or use the platform for any unlawful purpose.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Intellectual Property</h2>
          <p>All content on the Groomie platform — including logos, design, and software — is owned by Groomie and may not be reproduced without written permission. You retain ownership of content you upload (photos, reviews) but grant Groomie a non-exclusive license to display it on the platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">10. Changes to These Terms</h2>
          <p>Groomie may update these Terms at any time. Continued use of the platform after changes are posted constitutes acceptance of the revised Terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">11. Contact</h2>
          <p>Questions about these Terms? Email us at <a href="mailto:support@groomie.com" className="text-purple-600 hover:underline">support@groomie.com</a>.</p>
        </section>

      </div>

      <div className="mt-8 pt-6 border-t text-sm text-gray-400 flex gap-4">
        <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
        <Link to="/" className="hover:underline">Back to Home</Link>
      </div>
    </div>
  );
}
