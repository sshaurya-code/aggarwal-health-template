export const metadata = { title: "Privacy" };

// Public: Google requires a privacy policy link before the Drive sign-in can be published.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-[17px] leading-relaxed">
      <h1 className="text-[28px] font-bold">Privacy</h1>
      <p className="mt-4">This is a private app used by one family to keep its own records. It is not open to the public and has no other users.</p>
      <p className="mt-4">
        Records are stored in the family&apos;s own private storage and are only visible after signing in with the family&apos;s PIN. Nothing is sold, shared, or used for advertising.
      </p>
      <p className="mt-4">
        <strong>Google Drive:</strong> with the family&apos;s permission, the app saves a copy of each uploaded file into the family&apos;s own Google Drive, in a folder the app creates. It can
        only see the files and folders it created there, never anything else in that Drive. The permission can be removed at any time from the Google Account&apos;s security settings.
      </p>
      <p className="mt-4">
        <strong>Claude:</strong> each uploaded document, including ID cards, is sent to Anthropic&apos;s Claude API so it can draft the document&apos;s details. A family member checks every
        draft before anything is saved. Anthropic does not use data sent through its API to train its models.
      </p>
    </main>
  );
}
